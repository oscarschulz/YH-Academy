export function getStoredAuthToken() {
  return (
    sessionStorage.getItem('yh_token') ||
    localStorage.getItem('yh_token') ||
    sessionStorage.getItem('token') ||
    localStorage.getItem('token') ||
    ''
  ).trim()
}

function clearInvalidSessionState() {
  const explicitKeys = [
    'yh_user_loggedIn',
    'yh_user_name',
    'yh_user_full_name',
    'yh_user_display_name',
    'yh_user_username',
    'yh_user_email',
    'yh_user_avatar',
    'yh_user_cover_photo',
    'yh_user_first_name',
    'yh_user_firstname',
    'yh_user_surname',
    'yh_user_last_name',
    'yh_user_lastname',
    'yh_user_city',
    'yh_user_location_city',
    'yh_user_country',
    'yh_user_country_of_residence',
    'yh_user_location_country',
    'yh_current_user',
    'yh_user',
    'currentUser',
    'user',
    'yh_token',
    'token',
    'yh_academy_access',
    'yh_academy_home',
    'yh_academy_membership_status_v1',
    'yh_academy_application_profile',
    'yh_academy_roadmap_profile_v1',
    'yh_academy_roadmap_locked_v1',
    'yh_academy_profile_cache_v1',
    'yh_universe_visited_profile_cache_v1',
    'yh_dashboard_view_state_v1',
    'yhPlazaDirectoryStatusV1',
    'yh_federation_ladder_outcome_v1',
    'yh_plaza_access_status_v1',
    'yh_federation_access_status_v1',
    'yh_post_login_dashboard_bootstrap_v1',
  ]

  ;[localStorage, sessionStorage].forEach((store) => {
    try {
      explicitKeys.forEach((key) => store.removeItem(key))

      for (let index = store.length - 1; index >= 0; index -= 1) {
        const key = store.key(index)

        if (!key) continue

        if (key.startsWith('yh_') || key.startsWith('YH_')) {
          store.removeItem(key)
        }
      }
    } catch {
      // Keep invalid-session cleanup fail-safe.
    }
  })
}

function redirectToLoggedOutHome() {
  try {
    window.history.replaceState(null, '', '/')
  } catch {
    // Ignore history failures.
  }

  window.location.replace('/')
}

export async function apiFetch(url, options = {}) {
  const token = getStoredAuthToken()

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  })

  const result = await response.json().catch(() => ({}))

  const buildRequestError = (fallbackMessage = 'Request failed.') => {
    const error = new Error(result?.message || fallbackMessage)

    error.status = response.status
    error.statusCode = response.status
    error.data = result
    error.payload = result
    error.code = result?.code || ''
    error.url = url

    return error
  }

  const accountDeletionSucceeded =
    response.ok &&
    result?.success === true &&
    result?.accountDeleted === true &&
    String(options.method || 'GET').toUpperCase() === 'DELETE' &&
    String(url).split('?')[0] === '/api/account'

  if (
    response.status === 401 ||
    response.status === 410 ||
    (result?.accountDeleted === true && !accountDeletionSucceeded) ||
    (result?.logoutRequired === true &&
      (!response.ok || result?.success === false))
  ) {
    clearInvalidSessionState()
    redirectToLoggedOutHome()

    throw buildRequestError('Session expired.')
  }

  if (response.status === 400) {
    throw buildRequestError('Request failed.')
  }

  if (!response.ok || result?.success === false) {
    throw buildRequestError('Request failed.')
  }

  return result
}
