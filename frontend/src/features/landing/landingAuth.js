const REFERRAL_KEY =
  'yh_universe_referral_code_v1'

export const POST_LOGIN_KEY =
  'yh_post_login_dashboard_bootstrap_v1'

const PENDING_VERIFY_KEY =
  'yh_pending_verify_email'

const FRESH_AUTH_CLEAR_KEYS = [
  'yh_academy_access',
  'yh_academy_home',
  'yh_academy_membership_status_v1',
  'yh_academy_application_profile',
  'yh_academy_roadmap_profile_v1',
  'yh_academy_roadmap_locked_v1',
  'yh_admin_panel_state_v2',
  'yh_admin_panel_state_v3_live',
  'yh_force_academy_application_after_auth',

  'yh_academy_profile_cache_v1',
  'yh_universe_visited_profile_cache_v1',
  'yh_dashboard_view_state_v1',
  'yhPlazaDirectoryStatusV1',
  'yh_federation_ladder_outcome_v1',
  'yh_plaza_access_status_v1',
  'yh_federation_access_status_v1',

  'yh_user_loggedIn',
  'yh_user_name',
  'yh_user_username',
  'yh_user_email',
  'yh_user_avatar',
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
  'yh_token',
  'token',
  PENDING_VERIFY_KEY,
]

function clean(
  value = '',
) {
  return String(
    value ?? '',
  ).trim()
}

export function getPublicApiBase() {
  // Vite development uses same-origin API and Socket.IO proxies.
  if (
    import.meta.env.DEV &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ) {
    return '';
  }

  try {
    const configured =
      clean(
        window.YH_API_BASE ||
          window.API_BASE,
      ).replace(
        /\/+$/,
        '',
      )

    if (configured) {
      return configured
    }

    const isLocal =
      window.location.hostname ===
        'localhost' ||
      window.location.hostname ===
        '127.0.0.1'

    if (
      isLocal &&
      window.location.port &&
      window.location.port !==
        '3000'
    ) {
      return 'http://localhost:3000'
    }
  } catch {}

  return ''
}

export function resolvePublicUrl(
  value = '',
) {
  const path =
    clean(value)

  if (
    /^https?:\/\//i.test(
      path,
    )
  ) {
    return path
  }

  const base =
    getPublicApiBase()

  if (!base) {
    return path
  }

  return path.startsWith('/')
    ? `${base}${path}`
    : `${base}/${path}`
}

export async function publicJson(
  path,
  options = {},
) {
  const headers = {
    ...(options.body
      ? {
          'Content-Type':
            'application/json',
        }
      : {}),
    ...(options.headers || {}),
  }

  const response =
    await fetch(
      resolvePublicUrl(
        path,
      ),
      {
        ...options,
        credentials:
          options.credentials ||
          'include',
        headers,
      },
    )

  let data = {}

  try {
    data =
      await response.json()
  } catch {
    data = {}
  }

  return {
    response,
    data,
  }
}

export function normalizeReferralCode(
  value = '',
) {
  return clean(value)
    .toUpperCase()
    .replace(
      /[^A-Z0-9_-]+/g,
      '',
    )
    .slice(
      0,
      48,
    )
}

export function captureReferralFromUrl() {
  try {
    const url =
      new URL(
        window.location.href,
      )

    const code =
      normalizeReferralCode(
        url.searchParams.get(
          'ref',
        ) ||
          url.searchParams.get(
            'referral',
          ) ||
          url.searchParams.get(
            'referralCode',
          ) ||
          '',
      )

    if (!code) {
      return ''
    }

    sessionStorage.setItem(
      REFERRAL_KEY,
      code,
    )

    localStorage.setItem(
      REFERRAL_KEY,
      code,
    )

    return code
  } catch {
    return ''
  }
}

export function getReferralCode() {
  try {
    return normalizeReferralCode(
      sessionStorage.getItem(
        REFERRAL_KEY,
      ) ||
        localStorage.getItem(
          REFERRAL_KEY,
        ) ||
        '',
    )
  } catch {
    return ''
  }
}

export function clearReferralCode() {
  try {
    sessionStorage.removeItem(
      REFERRAL_KEY,
    )

    localStorage.removeItem(
      REFERRAL_KEY,
    )
  } catch {}
}

export function setPendingVerifyEmail(
  email = '',
) {
  const value =
    clean(email)
      .toLowerCase()

  if (!value) {
    return
  }

  try {
    sessionStorage.setItem(
      PENDING_VERIFY_KEY,
      value,
    )
  } catch {}
}

export function getPendingVerifyEmail() {
  try {
    return clean(
      sessionStorage.getItem(
        PENDING_VERIFY_KEY,
      ),
    ).toLowerCase()
  } catch {
    return ''
  }
}

export function clearPendingVerifyEmail() {
  try {
    sessionStorage.removeItem(
      PENDING_VERIFY_KEY,
    )
  } catch {}
}

export function clearFreshAuthState() {
  for (
    const store of [
      localStorage,
      sessionStorage,
    ]
  ) {
    for (
      const key of
      FRESH_AUTH_CLEAR_KEYS
    ) {
      try {
        store.removeItem(
          key,
        )
      } catch {}
    }
  }
}

export function persistClientSession(
  user = {},
  token = '',
) {
  const fullName =
    clean(
      user.fullName ||
        user.name ||
        user.displayName ||
        user.username ||
        'Hustler',
    )

  const nameParts =
    fullName
      .split(
        /\s+/,
      )
      .filter(
        Boolean,
      )

  const firstName =
    clean(
      user.firstName ||
        user.firstname ||
        nameParts[0] ||
        '',
    )

  const surname =
    clean(
      user.surname ||
        user.lastName ||
        user.lastname ||
        (
          nameParts.length >
          1
            ? nameParts
                .slice(1)
                .join(' ')
            : ''
        ),
    )

  const username =
    clean(
      user.username,
    )
      .replace(
        /^@+/,
        '',
      )
      .toLowerCase()

  const email =
    clean(
      user.email,
    ).toLowerCase()

  const city =
    clean(
      user.city,
    )

  const country =
    clean(
      user.country,
    )

  const locationCountry =
    [
      city,
      country,
    ]
      .filter(
        Boolean,
      )
      .join(', ') ||
    country

  let pendingAvatar = ''

  try {
    pendingAvatar =
      clean(
        sessionStorage.getItem(
          'yh_pending_profile_avatar',
        ) ||
          localStorage.getItem(
            'yh_pending_profile_avatar',
          ),
      )
  } catch {}

  const avatar =
    clean(
      user.avatar ||
        user.profilePhoto ||
        user.photoURL ||
        user.profilePhotoDataUrl ||
        pendingAvatar,
    )

  const authToken =
    clean(token)

  for (
    const store of [
      sessionStorage,
      localStorage,
    ]
  ) {
    try {
      store.setItem(
        'yh_user_loggedIn',
        'true',
      )

      store.setItem(
        'yh_user_name',
        fullName,
      )

      store.setItem(
        'yh_user_username',
        username,
      )

      store.setItem(
        'yh_user_email',
        email,
      )

      store.setItem(
        'yh_token',
        authToken,
      )

      store.setItem(
        'token',
        authToken,
      )

      if (firstName) {
        store.setItem(
          'yh_user_first_name',
          firstName,
        )

        store.setItem(
          'yh_user_firstname',
          firstName,
        )
      }

      if (surname) {
        store.setItem(
          'yh_user_surname',
          surname,
        )

        store.setItem(
          'yh_user_last_name',
          surname,
        )

        store.setItem(
          'yh_user_lastname',
          surname,
        )
      }

      if (city) {
        store.setItem(
          'yh_user_city',
          city,
        )

        store.setItem(
          'yh_user_location_city',
          city,
        )
      }

      if (country) {
        store.setItem(
          'yh_user_country',
          country,
        )

        store.setItem(
          'yh_user_country_of_residence',
          country,
        )

        store.setItem(
          'yh_user_location_country',
          country,
        )
      }

      if (
        locationCountry
      ) {
        store.setItem(
          'yh_user_location_country',
          locationCountry,
        )
      }

      if (avatar) {
        store.setItem(
          'yh_user_avatar',
          avatar,
        )
      }

      store.removeItem(
        'yh_pending_profile_avatar',
      )
    } catch {}
  }
}

export function isDeletedAccountResult(
  response,
  result = {},
) {
  return (
    result.accountDeleted ===
      true ||
    result.registrationRequired ===
      true ||
    Number(
      response?.status || 0,
    ) === 410
  )
}

export function hasStoredAuth() {
  try {
    return Boolean(
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
    return false
  }
}
