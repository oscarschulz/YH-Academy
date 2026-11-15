const PLAZA_UI_STATE_KEY =
  'yhPlazaUiStateCleanV1'

const DEFAULT_STATE = {
  feedFilter: 'all',
  questFilter: 'all',
  activeInboxRole: 'all',
  activeNotificationRole: 'all',
  directoryRegion: 'all',
  directoryDivision: 'all',
  directoryTrust: 'all',
}

export function readPlazaUiState() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          PLAZA_UI_STATE_KEY,
        ) || '{}',
      )

    return {
      ...DEFAULT_STATE,
      ...(parsed &&
      typeof parsed ===
        'object' &&
      !Array.isArray(parsed)
        ? parsed
        : {}),
    }
  } catch {
    return {
      ...DEFAULT_STATE,
    }
  }
}

export function updatePlazaUiState(
  patch = {},
) {
  const next = {
    ...readPlazaUiState(),
    ...patch,
  }

  try {
    localStorage.setItem(
      PLAZA_UI_STATE_KEY,
      JSON.stringify(next),
    )
  } catch {}

  return next
}
