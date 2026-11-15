export class AdminRequestError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'AdminRequestError'
    this.status = status
  }
}

export async function adminFetchJson(url, options = {}) {
  /* YHU_ADMIN_PHASE2_GUARDED_CUTOVER_V2: never enable mutations in preview */
  const method = String(options.method || 'GET').toUpperCase()

  if (method !== 'GET' && method !== 'HEAD') {
    const livePanel =
      /^\/admin\/[A-Za-z0-9_-]{32,128}\/panel\/?$/.test(
        window.location.pathname
      )

    const adminEndpoint =
      /^\/api\/admin\/(?:applications|members|academy|federation|plaza|plazas|support|settings|economy|broadcasts)(?:\/|$)/.test(
        String(url || '')
      )

    if (!livePanel || !adminEndpoint) {
      throw new AdminRequestError(
        'React Admin preview is read-only. Use the authenticated live React panel for Admin updates.',
        423
      )
    }
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => null)

  if (
    response.status === 401 ||
    data?.message === 'No active admin session.'
  ) {
    throw new AdminRequestError(
      'No active admin session.',
      401
    )
  }

  if (!response.ok || data?.success !== true) {
    throw new AdminRequestError(
      data?.message || 'Admin request failed.',
      response.status
    )
  }

  return data
}

export async function copyAdminText(text) {
  const value = String(text ?? '').trim()
  if (!value) return false

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Fall back to the Original Admin copy method.
  }

  const field = document.createElement('textarea')
  field.value = value
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  field.style.pointerEvents = 'none'
  document.body.appendChild(field)

  try {
    field.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
  }
}

export async function getAdminBootstrap(signal) {
  const data = await adminFetchJson('/api/admin/bootstrap', {
    method: 'GET',
    cache: 'no-store',
    signal,
  })

  if (
    !data.state ||
    typeof data.state !== 'object' ||
    Array.isArray(data.state)
  ) {
    throw new AdminRequestError(
      'Invalid admin bootstrap response.'
    )
  }

  return {
    state: data.state,
    user: data.user || null,
  }
}

export function getAdminPrivateLoginPath() {
  const match = window.location.pathname.match(
    /^\/admin\/([A-Za-z0-9_-]{32,128})\/(?:panel|panel-preview)\/?$/
  )

  return match
    ? `/admin/${encodeURIComponent(match[1])}/login`
    : '/'
}
