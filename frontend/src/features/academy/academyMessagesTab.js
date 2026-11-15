export const MESSAGES_TAB_KEY =
  'yh_academy_messages_active_tab_v1'

export function readMessagesTab() {
  try {
    return localStorage.getItem(
      MESSAGES_TAB_KEY,
    ) === 'group'
      ? 'group'
      : 'dm'
  } catch {
    return 'dm'
  }
}

export function writeMessagesTab(
  value = 'dm',
) {
  const next =
    value === 'group'
      ? 'group'
      : 'dm'

  try {
    localStorage.setItem(
      MESSAGES_TAB_KEY,
      next,
    )
  } catch {}

  return next
}
