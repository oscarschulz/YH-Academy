const STORAGE_KEY =
  'yhPlazaNotificationsCleanV1'

export const PLAZA_NOTIFICATION_ROLES = [
  ['all', 'All queues'],
  ['personal', 'Personal'],
  ['project-owner', 'Project Owner'],
  ['project-manager', 'Project Manager'],
  ['hr', 'HR'],
  ['plaza-ops', 'Plaza Ops'],
  ['system-admin', 'YH System Admin'],
]

function clean(value = '') {
  return String(
    value ?? '',
  ).trim()
}

export function getPlazaNotificationRoleLabel(
  value = '',
) {
  const key =
    clean(value)
      .toLowerCase()

  return (
    PLAZA_NOTIFICATION_ROLES.find(
      ([role]) =>
        role === key,
    )?.[1] ||
    'Personal'
  )
}

function normalizeRole(
  value = '',
) {
  const cleanValue =
    clean(value)

  return (
    PLAZA_NOTIFICATION_ROLES.some(
      ([key]) =>
        key === cleanValue,
    )
      ? cleanValue
      : 'personal'
  )
}

export function normalizePlazaNotification(
  item = {},
  index = 0,
) {
  return {
    ...item,

    id:
      clean(item.id) ||
      `notification-${index + 1}`,

    title:
      clean(item.title) ||
      'Plaza notification',

    text:
      clean(item.text),

    audienceRole:
      clean(
        item.audienceRole,
      ) === 'all'
        ? 'all'
        : normalizeRole(
            item.audienceRole,
          ),

    relatedType:
      clean(
        item.relatedType,
      ) || 'general',

    relatedId:
      clean(
        item.relatedId,
      ),

    status:
      clean(
        item.status,
      ).toLowerCase() ===
      'read'
        ? 'read'
        : 'unread',

    createdAt:
      item.createdAt ||
      new Date()
        .toISOString(),
  }
}

export function readPlazaNotifications() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          STORAGE_KEY,
        ) || '[]',
      )

    return Array.isArray(
      parsed,
    )
      ? parsed.map(
          normalizePlazaNotification,
        )
      : []
  } catch {
    return []
  }
}

export function writePlazaNotifications(
  items = [],
) {
  const normalized =
    Array.isArray(items)
      ? items.map(
          normalizePlazaNotification,
        )
      : []

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        normalized,
      ),
    )
  } catch {}

  return normalized
}

export function createPlazaNotification(
  payload = {},
) {
  const current =
    readPlazaNotifications()

  const item =
    normalizePlazaNotification({
      id:
        payload.id ||
        `notification-${Date.now()}-${Math.floor(
          Math.random() *
            1000,
        )}`,

      createdAt:
        new Date()
          .toISOString(),

      ...payload,
    })

  writePlazaNotifications([
    item,
    ...current.filter(
      (entry) =>
        entry.id !==
        item.id,
    ),
  ])

  return item
}

export function markPlazaNotificationRead(
  id = '',
) {
  const cleanId =
    clean(id)

  if (!cleanId) {
    return null
  }

  const current =
    readPlazaNotifications()

  let updated =
    null

  const next =
    current.map(
      (item) => {
        if (
          item.id !==
          cleanId
        ) {
          return item
        }

        updated = {
          ...item,
          status:
            'read',
        }

        return updated
      },
    )

  if (!updated) {
    return null
  }

  writePlazaNotifications(
    next,
  )

  return updated
}


export function markAllPlazaNotificationsRead() {
  const next =
    readPlazaNotifications()
      .map(
        (item) => ({
          ...item,
          status:
            'read',
        }),
      )

  return writePlazaNotifications(
    next,
  )
}
