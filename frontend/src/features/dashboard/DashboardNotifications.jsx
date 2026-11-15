import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { io } from 'socket.io-client'
import { loadMessagesInbox } from '../messages/messagesUtils.js'
import { apiFetch } from '../../services/api/apiClient'
import { getCachedDivisionAccessState } from './dashboardAccess'
import {
  readCache,
  /* YHU_BUSINESS_CHAT_SEPARATE_SEEN_KEYS_PARITY */
  readInlineLastSeen,
  writeInlineLastSeen,
  writeCache,
  dedupeConversations,
  conversationUpdatedAt,
} from '../business-chats/businessChatsUtils.js'

function clean(value = '') {
  return String(value || '').trim()
}

function dashboardNotificationAuthToken() {
  try {
    return clean(
      sessionStorage.getItem(
        'yh_token',
      ) ||
        localStorage.getItem(
          'yh_token',
        ) ||
        sessionStorage.getItem(
          'token',
        ) ||
        localStorage.getItem(
          'token',
        ),
    )
  } catch {
    return ''
  }
}

function isRead(notification = {}) {
  const values = [
    notification.isRead,
    notification.is_read,
    notification.read,
  ]

  if (
    values.some(
      (value) =>
        value === true ||
        String(value)
          .trim()
          .toLowerCase() ===
          'true',
    )
  ) {
    return true
  }

  return Boolean(
    notification.readAt ||
      notification.read_at,
  )
}

function normalizeTarget(
  notification = {},
) {
  const raw =
    clean(
      notification.target ||
        notification.targetType ||
        notification.target_type ||
        notification.type ||
        '',
    ).toLowerCase()

  if (
    [
      'squad-mission-history',
      'squad_mission_history',
      'squad-mission',
      'squad_mission',
      'squad-mission-completed',
      'squad_mission_completed',
    ].includes(raw)
  ) {
    return 'squad-mission-history'
  }

  if (
    [
      'announcement',
      'announcements',
    ].includes(raw)
  ) {
    return 'announcements'
  }

  if (
    [
      'main-chat',
      'main_chat',
      'chat',
      'community',
      'community-feed',
      'community_feed',
      'feed',
      'post',
      'comment',
      'like',
    ].includes(raw)
  ) {
    return 'main-chat'
  }

  if (
    [
      'dm',
      'direct-message',
      'direct_message',
      'message',
      'messages',
      'room',
      'chat-room',
      'chat_room',
    ].includes(raw)
  ) {
    return 'dm'
  }

  if (
    [
      'profile',
      'user-profile',
      'user_profile',
      'follow',
      'follower',
    ].includes(raw)
  ) {
    return 'profile'
  }

  return raw
}

function normalizeNotification(
  notification = {},
  authority = '',
) {
  const title =
    clean(
      notification.title,
    ) || 'Notification'

  const text =
    clean(
      notification.text ||
        notification.message ||
        notification.body,
    )

  const id =
    clean(
      notification.id ||
        notification.notificationId ||
        notification.notification_id,
    )

  const target =
    normalizeTarget(
      notification,
    )

  return {
    ...notification,

    id,

    title,

    text,

    avatarStr:
      clean(
        notification.avatarStr ||
          notification.initial,
      ) ||
      title
        .charAt(0)
        .toUpperCase() ||
      'N',

    color:
      clean(
        notification.color,
      ) ||
      'var(--neon-blue)',

    target,

    targetId:
      clean(
        notification.targetId ||
          notification.target_id,
      ),

    createdAt:
      notification.createdAt ||
      notification.created_at ||
      notification.time ||
      '',

    isRead:
      isRead(notification),

    notificationAuthority:
      clean(
        authority ||
          notification.notificationAuthority ||
          notification.notification_authority,
      ).toLowerCase(),
  }
}

/* YHU_DASHBOARD_BUSINESS_CHAT_BELL_PARITY */
function cachedBusinessChatNotifications(conversations = []) {
  const lastSeen = readInlineLastSeen()

  return dedupeConversations(conversations).map(conversation => {
    const id = clean(conversation?.id)
    const updated = conversationUpdatedAt(conversation)

    const latest = Array.isArray(conversation?.messages)
      ? conversation.messages[conversation.messages.length - 1]
      : null

    const title = clean(conversation?.title) || 'Plaza business conversation'
    const message = clean(latest?.text || conversation?.businessPurpose)

    return normalizeNotification({
      id: 'business-chat-' + id,
      source: 'business-chat',
      title: 'Business Chat Update',
      text: title + (message ? ': ' + message.slice(0, 120) : ''),
      avatarStr: '💬',
      target: 'business-chats',
      targetId: id,
      createdAt: updated ? new Date(updated).toISOString() : '',
      isRead: !updated || updated <= lastSeen,
    }, 'business-chat')
  }).filter(item => item.targetId)
}

function timeLabel(value = '') {
  if (!value) {
    return 'Just now'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Just now'
  }

  const diffMs =
    Date.now() -
    date.getTime()

  const diffMin =
    Math.max(
      0,
      Math.floor(
        diffMs / 60000,
      ),
    )

  if (diffMin < 1) {
    return 'Just now'
  }

  if (diffMin < 60) {
    return `${diffMin}m ago`
  }

  const diffHr =
    Math.floor(
      diffMin / 60,
    )

  if (diffHr < 24) {
    return `${diffHr}h ago`
  }

  const diffDay =
    Math.floor(
      diffHr / 24,
    )

  if (diffDay < 7) {
    return `${diffDay}d ago`
  }

  return date.toLocaleDateString()
}

function mergeNotifications(
  realtime = [],
  system = [],
) {
  const merged =
    new Map()

  ;[
    ...realtime,
    ...system,
  ].forEach(
    (notification) => {
      if (!notification.id) {
        return
      }

      merged.set(
        notification.id,
        notification,
      )
    },
  )

  return Array.from(
    merged.values(),
  ).sort((a, b) =>
    String(
      b.createdAt || '',
    ).localeCompare(
      String(
        a.createdAt || '',
      ),
    ),
  )
}

export default function DashboardNotifications({
  onTargetOpen,
  onToast,
}) {
  const [notifications, setNotifications] =
    useState([])

  const [open, setOpen] =
    useState(false)

  const [loading, setLoading] =
    useState(false)

  const [
    markingAll,
    setMarkingAll,
  ] = useState(false)

  const [itemBusy, setItemBusy] =
    useState('')

  const rootRef =
    useRef(null)

  const requestRef =
    useRef(0)

  /* YHU_REACT_REALTIME_NOTIFICATIONS */
  useEffect(() => {
    const token =
      dashboardNotificationAuthToken()

    const socket =
      io({
        withCredentials:
          true,

        transports: [
          'websocket',
          'polling',
        ],

        reconnection:
          true,

        reconnectionAttempts:
          5,

        reconnectionDelay:
          1200,

        auth: token
          ? {
              token,
            }
          : {},
      })

    const pushNotification =
      (payload = {}) => {
        const raw =
          payload?.notification &&
          typeof payload
            .notification ===
            'object'
            ? payload.notification
            : payload

        if (
          !raw ||
          typeof raw !==
            'object'
        ) {
          return
        }

        const incoming =
          normalizeNotification(
            raw,
            'realtime',
          )

        if (normalizeTarget(raw) === 'dm') void loadMessagesInbox({ force: true }).catch(() => {})

        if (!incoming.id) {
          return
        }

        setNotifications(
          (current) =>
            mergeNotifications(
              current,
              [
                incoming,
              ],
            ),
        )
      }

    const refreshMessages = () => { void loadMessagesInbox({ force: true }).catch(() => {}) }
    socket.on('connect', refreshMessages)

    socket.on(
      'realtimeNotification',
      pushNotification,
    )

    /*
     * Preserve Dashboard compatibility with
     * the older notification event as well.
     */

    return () => {
      socket.off(
        'realtimeNotification',
        pushNotification,
      )


      socket.off('connect', refreshMessages)
      socket.disconnect()
    }
  }, [])

  const loadNotifications =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        const requestToken =
          ++requestRef.current

        if (!silent) {
          setLoading(true)
        }

        try {
          const plazaApproved =
            getCachedDivisionAccessState('plazas')?.approved === true

          const [
            realtimeResult,
            systemResult,
            businessResult,
          ] =
            await Promise.allSettled([
              apiFetch(
                '/api/realtime/notifications',
                {
                  method: 'GET',
                },
              ),

              apiFetch(
                '/api/member/system-notifications',
                {
                  method: 'GET',
                },
              ),

              plazaApproved
                ? apiFetch('/api/plaza/messages?limit=160', {
                    method: 'GET',
                    cache: 'no-store',
                  })
                : Promise.resolve(null),
            ])

          if (
            requestToken !==
            requestRef.current
          ) {
            return []
          }

          const realtime =
            realtimeResult.status ===
              'fulfilled' &&
            Array.isArray(
              realtimeResult.value
                ?.notifications,
            )
              ? realtimeResult.value.notifications.map(
                  (item) =>
                    normalizeNotification(
                      item,
                      'realtime',
                    ),
                )
              : []

          const system =
            systemResult.status ===
              'fulfilled' &&
            Array.isArray(
              systemResult.value
                ?.notifications,
            )
              ? systemResult.value.notifications.map(
                  (item) =>
                    normalizeNotification(
                      item,
                      'member-system',
                    ),
                )
              : []

          if (
            realtimeResult.status ===
              'rejected' &&
            systemResult.status ===
              'rejected'
          ) {
            throw new Error(
              realtimeResult.reason
                ?.message ||
                systemResult.reason
                  ?.message ||
                'Failed to load notifications.',
            )
          }

          let businessConversations = []

          if (plazaApproved) {
            if (
              businessResult.status === 'fulfilled' &&
              Array.isArray(businessResult.value?.conversations)
            ) {
              businessConversations = dedupeConversations(
                businessResult.value.conversations,
              )
              writeCache(businessConversations)
            } else {
              businessConversations = readCache().conversations || []
            }
          }

          const merged = mergeNotifications(
            [
              ...realtime,
              ...cachedBusinessChatNotifications(businessConversations),
            ],
            system,
          )

          setNotifications(
            merged,
          )

          return merged
        } catch (error) {
          if (!silent) {
            onToast?.(
              error?.message ||
                'Failed to load notifications.',
              'error',
            )
          }

          return []
        } finally {
          if (
            requestToken ===
            requestRef.current
          ) {
            setLoading(false)
          }
        }
      },
      [onToast],
    )

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadNotifications({ silent: true })
    }, 0)

    const handleOutside = (
      event,
    ) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(
          event.target,
        )
      ) {
        setOpen(false)
      }
    }

    const handleFocus = () => {
      void loadNotifications({
        silent: true,
      })
    }

    const handleVisibility = () => {
      if (
        document.visibilityState ===
        'visible'
      ) {
        void loadNotifications({
          silent: true,
        })
      }
    }

    const handleMessage = (
      event,
    ) => {
      if (
        event.origin !==
        window.location.origin
      ) {
        return
      }

      const data =
        event.data &&
        typeof event.data ===
          'object'
          ? event.data
          : null

      if (
        data?.type ===
        'yhu:academy-squad-action-completed'
      ) {
        window.setTimeout(
          () => {
            void loadNotifications({
              silent: true,
            })
          },
          160,
        )
      }
    }

    document.addEventListener(
      'pointerdown',
      handleOutside,
    )

    document.addEventListener(
      'visibilitychange',
      handleVisibility,
    )

    window.addEventListener(
      'focus',
      handleFocus,
    )

    window.addEventListener(
      'message',
      handleMessage,
    )

    const interval =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            'visible'
          ) {
            void loadNotifications({
              silent: true,
            })
          }
        },
        30000,
      )

    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(
        interval,
      )

      document.removeEventListener(
        'pointerdown',
        handleOutside,
      )

      document.removeEventListener(
        'visibilitychange',
        handleVisibility,
      )

      window.removeEventListener(
        'focus',
        handleFocus,
      )

      window.removeEventListener(
        'message',
        handleMessage,
      )
    }
  }, [loadNotifications])

  const unread =
    useMemo(
      () =>
        notifications.filter(
          (item) =>
            !item.isRead,
        ),
      [notifications],
    )

  const markOneRead =
    async (
      notification,
    ) => {
      if (
        !notification?.id ||
        notification.isRead
      ) {
        return true
      }

      setItemBusy(
        notification.id,
      )

      try {
        if (notification.notificationAuthority === 'business-chat') {
          writeInlineLastSeen()

          setNotifications(current => current.map(item =>
            item.notificationAuthority === 'business-chat'
              ? { ...item, isRead: true, readAt: new Date().toISOString() }
              : item,
          ))

          return true
        }

        const authority =
          notification.notificationAuthority

        const endpoint =
          authority ===
          'member-system'
            ? `/api/member/system-notifications/${encodeURIComponent(
                notification.id,
              )}/read`
            : `/api/realtime/notifications/${encodeURIComponent(
                notification.id,
              )}/read`

        await apiFetch(
          endpoint,
          {
            method: 'POST',
          },
        )

        const readAt =
          new Date().toISOString()

        setNotifications(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                notification.id
                  ? {
                      ...item,
                      isRead:
                        true,
                      readAt,
                    }
                  : item,
            ),
        )

        return true
      } catch (error) {
        onToast?.(
          error?.message ||
            'Failed to mark notification as read.',
          'error',
        )

        await loadNotifications({
          silent: true,
        })

        return false
      } finally {
        setItemBusy('')
      }
    }

  const markAllRead =
    async (event) => {
      event.preventDefault()
      event.stopPropagation()

      if (
        markingAll ||
        !unread.length
      ) {
        return
      }

      setMarkingAll(true)

      try {
        const results =
          await Promise.allSettled([
            apiFetch(
              '/api/realtime/notifications/read-all',
              {
                method: 'POST',
              },
            ),

            apiFetch(
              '/api/member/system-notifications/read-all',
              {
                method: 'POST',
              },
            ),
          ])

        const failed =
          results.filter(
            (result) =>
              result.status ===
              'rejected',
          )

        if (failed.length) {
          throw new Error(
            'Failed to persist all notification read states.',
          )
        }

        const readAt =
          new Date().toISOString()

        writeInlineLastSeen()

        setNotifications(
          (current) =>
            current.map(
              (item) => ({
                ...item,
                isRead: true,
                readAt,
              }),
            ),
        )

        onToast?.(
          'All notifications marked as read.',
          'success',
        )
      } catch (error) {
        await loadNotifications({
          silent: true,
        })

        onToast?.(
          error?.message ||
            'Failed to mark notifications as read.',
          'error',
        )
      } finally {
        setMarkingAll(false)
      }
    }

  const openNotification =
    async (
      notification,
    ) => {
      const persisted =
        await markOneRead(
          notification,
        )

      if (!persisted) {
        return
      }

      setOpen(false)

      onTargetOpen?.(
        notification.target,
        notification.targetId,
        notification,
      )
    }

  return (
    <div
      ref={rootRef}
      className={`notif-wrapper mobile-notif-under-name ${
        open
          ? 'yh-notif-open'
          : ''
      }`}
      id="notif-bell"
    >
      <button
        type="button"
        className="notif-icon yhu-dashboard-notif-trigger"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={async (
          event,
        ) => {
          event.preventDefault()
          event.stopPropagation()

          const next =
            !open

          setOpen(next)

          if (next) {
            await loadNotifications()
          }
        }}
      >
        <img
          src="/assets/academy/icons/notif-bell.png"
          alt=""
          className="notif-icon-img"
          loading="lazy"
          decoding="async"
        />
      </button>

      {unread.length > 0 && (
        <span
          className="notif-badge"
          id="notif-badge-count"
        >
          {unread.length > 99
            ? '99+'
            : unread.length}
        </span>
      )}

      <div
        className={`notif-dropdown hide-scrollbar ${
          open ? 'show' : ''
        }`}
        id="notif-dropdown"
        aria-hidden={
          open
            ? 'false'
            : 'true'
        }
        onClick={(
          event,
        ) =>
          event.stopPropagation()
        }
      >
        <div className="notif-header">
          Notifications

          <button
            type="button"
            id="mark-all-read"
            className="yhu-dashboard-notif-readall"
            disabled={
              markingAll ||
              !unread.length
            }
            onClick={
              markAllRead
            }
          >
            {markingAll
              ? 'Marking as read...'
              : 'Mark all as read'}
          </button>
        </div>

        <ul
          className="notif-list"
          id="notif-list-container"
        >
          {loading &&
          !notifications.length ? (
            <li className="notif-empty-state">
              Loading notifications...
            </li>
          ) : !unread.length ? (
            <li
              className="notif-empty-state"
              id="notif-empty-state"
            >
              No new notifications.
            </li>
          ) : (
            unread.map(
              (notification) => (
                <li
                  key={
                    notification.id
                  }
                  className="fade-in unread"
                  data-notification-id={
                    notification.id
                  }
                  data-target={
                    notification.target
                  }
                >
                  <button
                    type="button"
                    className="yhu-dashboard-notif-entry"
                    disabled={
                      itemBusy ===
                      notification.id
                    }
                    onClick={() =>
                      openNotification(
                        notification,
                      )
                    }
                  >
                    <div
                      className="notif-img"
                      style={{
                        background:
                          notification.color,
                      }}
                    >
                      {
                        notification.avatarStr
                      }
                    </div>

                    <div className="notif-text yhu-dashboard-notif-copy">
                      <strong>
                        {
                          notification.title
                        }
                      </strong>

                      {notification.text
                        ? ` ${notification.text}`
                        : ''}

                      <span className="notif-time">
                        {timeLabel(
                          notification.createdAt,
                        )}
                      </span>
                    </div>
                  </button>
                </li>
              ),
            )
          )}
        </ul>
      </div>
    </div>
  )
}
