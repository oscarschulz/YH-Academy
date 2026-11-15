import { PLAZA_NOTIFICATION_ROLES } from './plazaNotifications'
export function clean(value = '') {
  return String(
    value ?? '',
  ).trim()
}

export function roleLabel(
  value = '',
) {
  return (
    PLAZA_NOTIFICATION_ROLES.find(
      ([key]) =>
        key === value,
    )?.[1] ||
    'Personal'
  )
}

export function formatDate(
  value = '',
) {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return ''
  }

  return date.toLocaleString()
}

export function relatedLabel(
  value = '',
) {
  const cleanValue =
    clean(value)
      .replace(
        /[-_]+/g,
        ' ',
      )

  return (
    cleanValue
      .replace(
        /\b\w/g,
        (char) =>
          char.toUpperCase(),
      ) ||
    'General'
  )
}
