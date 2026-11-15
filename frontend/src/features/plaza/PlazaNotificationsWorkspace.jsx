import { clean, roleLabel, formatDate, relatedLabel } from './plazaNotificationViewUtils.js'
import { apiFetch } from '../../services/api/apiClient'
import { io } from 'socket.io-client'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  PLAZA_NOTIFICATION_ROLES,
  markAllPlazaNotificationsRead,
  markPlazaNotificationRead,
  readPlazaNotifications,
} from './plazaNotifications'

import {
  readPlazaUiState,
  updatePlazaUiState,
} from './plazaUiState'

import './PlazaNotificationsWorkspace.css'

export default function PlazaNotificationsWorkspace({
  onToast,
  onWorkspaceOpen,
}) {
  /* YHU_PLAZA_PHASE2_SERVER_NOTIFICATION_AUTHORITY */
  const [localItems, setLocalItems] = useState(
    () => readPlazaNotifications()
  )
  const [serverItems, setServerItems] = useState([])
  const [serverError, setServerError] = useState('')

  const items = useMemo(
    () => [
      ...serverItems,
      ...localItems.map(item => ({
        ...item,
        storageSource: 'local'
      }))
    ],
    [serverItems, localItems]
  )

  const [
    role,
    setRole,
  ] = useState(
    () => {
      const saved =
        clean(
          readPlazaUiState()
            .activeNotificationRole,
        )

      return (
        PLAZA_NOTIFICATION_ROLES.some(
          ([key]) =>
            key === saved,
        )
          ? saved
          : 'all'
      )
    },
  )

  useEffect(() => {
    let active = true

    const refreshLocal = () => {
      if (active) setLocalItems(readPlazaNotifications())
    }

    const refreshServer = async () => {
      if (document.hidden) return

      try {
        const result = await apiFetch(
          '/api/realtime/notifications',
          { method: 'GET', cache: 'no-store' }
        )

        if (!active) return

        if (!Array.isArray(result?.notifications)) {
          throw Error('Invalid notification response.')
        }

        const records = result.notifications
          .filter(item => [
            item.source,
            item.notificationType,
            item.notification_type,
            item.target,
            item.targetType
          ].some(value =>
            /plaza|business.chat/i.test(String(value || ''))
          ))
          .filter(item => item.id)
          .map(item => ({
            ...item,
            id: 'server:' + item.id,
            serverId: String(item.id),
            storageSource: 'server',
            title: clean(item.title) || 'Plaza notification',
            text: clean(item.text || item.message || item.body),
            audienceRole: 'personal',
            relatedType: /conversation|business.chat/i.test(
              String(item.target || item.targetType || '')
            ) ? 'conversation' : /inbox/i.test(
              String(item.target || '')
            ) ? 'inbox' : /request/i.test(
              String(item.target || '')
            ) ? 'request' : 'general',
            relatedId: clean(item.targetId || item.target_id),
            status: item.isRead || item.is_read || item.read
              ? 'read' : 'unread',
            createdAt: item.createdAt || item.created_at
          }))

        setServerItems(records)
        setServerError('')
      } catch (error) {
        if (active) {
          setServerError(
            error?.message || 'Server notifications unavailable.'
          )
        }
      }
    }

    const refresh = () => {
      refreshLocal()
      void refreshServer()
    }

    refresh()
    window.addEventListener('storage', refreshLocal)
    window.addEventListener('focus', refresh)

    /* YHU_PLAZA_PHASE3_REALTIME_NOTIFICATIONS */

    const token = (() => {
      try {
        return String(
          sessionStorage.getItem('yh_token') ||
          localStorage.getItem('yh_token') ||
          sessionStorage.getItem('token') ||
          localStorage.getItem('token') ||
          ''
        ).trim()
      } catch {
        return ''
      }
    })()

    const socket = io({
      withCredentials: true,
      transports: [
        'websocket',
        'polling'
      ],
      auth: token ? { token } : {}
    })

    const onRealtimeNotification = () => {
      void refreshServer()
    }

    socket.on(
      'realtimeNotification',
      onRealtimeNotification
    )

    socket.on(
      'connect',
      onRealtimeNotification
    )

    const interval = window.setInterval(refreshServer, 45000)

    return () => {
      active = false

      socket.off(
        'realtimeNotification',
        onRealtimeNotification
      )

      socket.off(
        'connect',
        onRealtimeNotification
      )

      socket.disconnect()

      window.clearInterval(interval)
      window.removeEventListener('storage', refreshLocal)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  const visible =
    useMemo(
      () =>
        items
          .filter(
            (item) =>
              role ===
                'all' ||
              item.audienceRole ===
                'all' ||
              item.audienceRole ===
                role,
          )
          .sort(
            (a, b) =>
              new Date(
                b.createdAt,
              ).getTime() -
              new Date(
                a.createdAt,
              ).getTime(),
          ),
      [
        items,
        role,
      ],
    )

  const unreadCount =
    items.filter(
      (item) =>
        item.status ===
        'unread',
    ).length

  const openNotification = async (notification) => {
    let updated

    if (notification.storageSource === 'server') {
      try {
        const result = await apiFetch(
          '/api/realtime/notifications/' +
            encodeURIComponent(notification.serverId) +
            '/read',
          {
            method: 'POST',
            body: JSON.stringify({})
          }
        )

        if (result?.success !== true) {
          throw Error('Backend did not confirm read status.')
        }

        updated = { ...notification, status: 'read' }

        setServerItems(current => current.map(item =>
          item.serverId === notification.serverId
            ? updated : item
        ))
      } catch (error) {
        onToast?.(
          error?.message || 'Read status was not saved.',
          'error'
        )
        return
      }
    } else {
      updated = markPlazaNotificationRead(notification.id)
      if (!updated) return
      setLocalItems(readPlazaNotifications())
    }

    if (updated.relatedType === 'conversation' && updated.relatedId) {
      try {
        sessionStorage.setItem(
          'yh_plaza_open_conversation_id',
          updated.relatedId
        )
      } catch {}

      onWorkspaceOpen?.('plazas-conversations')
      return
    }

    if (updated.relatedType === 'inbox') {
      if (updated.relatedId) {
        try {
          sessionStorage.setItem(
            'yh_plaza_open_inbox_id',
            updated.relatedId
          )
        } catch {}
      }

      onWorkspaceOpen?.('plazas-inbox')
      return
    }

    if (updated.relatedType === 'request') {
      onWorkspaceOpen?.('plazas-requests')
      return
    }

    onToast?.('Notification marked as read.', 'success')
  }

  const markAllRead = async () => {
    const unread = serverItems.filter(item => item.status !== 'read')

    const results = await Promise.allSettled(
      unread.map(item => apiFetch(
        '/api/realtime/notifications/' +
          encodeURIComponent(item.serverId) +
          '/read',
        {
          method: 'POST',
          body: JSON.stringify({})
        }
      ))
    )

    const saved = new Set()

    results.forEach((result, index) => {
      if (
        result.status === 'fulfilled' &&
        result.value?.success === true
      ) {
        saved.add(unread[index].serverId)
      }
    })

    setServerItems(current => current.map(item =>
      saved.has(item.serverId)
        ? { ...item, status: 'read' }
        : item
    ))

    setLocalItems(markAllPlazaNotificationsRead())

    const failed = unread.length - saved.size

    onToast?.(
      failed
        ? failed + ' server notifications failed to save.'
        : 'Plaza notifications marked as read.',
      failed ? 'error' : 'success'
    )
  }

  return (
    <section
      className="yh-dashboard-react-workspace yh-plaza-react-workspace"
      data-yh-dashboard-react-surface="plazas-notifications"
    >
      <div className="yh-plaza-notifications-scroll">
        <div className="yh-plaza-notifications-shell">
          <header className="yh-plaza-notifications-hero">
            <div>
              <span className="yh-plaza-react-kicker">
                Plaza Operations
              </span>

              <h1>
                Notifications
              </h1>

              <p>
                Awareness and
                delivery events
                across your Plaza
                activity.
              </p>
            </div>

            <button
              type="button"
              className="btn-secondary"
              disabled={
                unreadCount === 0
              }
              onClick={
                markAllRead
              }
            >
              Mark all read
            </button>
          </header>

          {serverError && (
            <div className="yh-plaza-react-state is-error" role="status">
              Server notifications unavailable: {serverError}
            </div>
          )}

          <div className="yh-plaza-notifications-meta">
            <span>
              {unreadCount}{' '}
              unread
            </span>

            <span>
              {items.length}{' '}
              total
            </span>
          </div>

          <div className="yh-plaza-notifications-filters">
            {PLAZA_NOTIFICATION_ROLES.map(
              ([
                key,
                label,
              ]) => (
                <button
                  key={key}
                  type="button"
                  className={
                    role === key
                      ? 'is-active'
                      : ''
                  }
                  onClick={() => {
                    setRole(key)

                    updatePlazaUiState({
                      activeNotificationRole:
                        key,
                    })
                  }}
                >
                  {label}

                  <span>
                    {
                      items.filter(
                        (item) =>
                          key ===
                            'all' ||
                          item.audienceRole ===
                            'all' ||
                          item.audienceRole ===
                            key,
                      ).length
                    }
                  </span>
                </button>
              ),
            )}
          </div>

          {!visible.length ? (
            <div className="yh-plaza-react-state">
              No notifications are
              visible in this lane
              yet.
            </div>
          ) : (
            <div className="yh-plaza-notifications-list">
              {visible.map(
                (item) => (
                  <article
                    key={
                      item.id
                    }
                    className={
                      'yh-plaza-notification-card ' +
                      (
                        item.status ===
                        'unread'
                          ? 'is-unread'
                          : ''
                      )
                    }
                  >
                    <div className="yh-plaza-notification-card-head">
                      <div>
                        <span className="yh-plaza-notification-role">
                          {item.audienceRole ===
                          'all'
                            ? 'All queues'
                            : roleLabel(
                                item.audienceRole,
                              )}
                        </span>

                        <h3>
                          {item.title}
                        </h3>
                      </div>

                      <span className="yh-plaza-notification-status">
                        {item.status}
                      </span>
                    </div>

                    {item.text && (
                      <p>
                        {item.text}
                      </p>
                    )}

                    <div className="yh-plaza-notification-card-meta">
                      <span>
                        {formatDate(
                          item.createdAt,
                        )}
                      </span>

                      <span>
                        {relatedLabel(
                          item.relatedType,
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        openNotification(
                          item,
                        )
                      }
                    >
                      Open
                    </button>
                  </article>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
