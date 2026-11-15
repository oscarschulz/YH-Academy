import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

const KEY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/

export default function AdminLoginPage() {
  const { adminRouteKey = '' } = useParams()

  const validKey = KEY_PATTERN.test(adminRouteKey)

  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loginPath = validKey
    ? `/api/admin/${encodeURIComponent(adminRouteKey)}/login`
    : ''

  const sessionPath = validKey
    ? `/api/admin/${encodeURIComponent(adminRouteKey)}/session`
    : ''

  const panelPath = validKey
    ? `/admin/${encodeURIComponent(adminRouteKey)}/panel`
    : '/'

  useEffect(() => {
    const links = []

    for (const config of [
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com'
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous'
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap'
      },
      {
        rel: 'stylesheet',
        href: '/admin-login.css'
      }
    ]) {
      const link = document.createElement('link')
      Object.assign(link, config)
      document.head.appendChild(link)
      links.push(link)
    }

    const previousTitle = document.title
    document.title = 'YH Admin Login'

    return () => {
      links.forEach(link => link.remove())
      document.title = previousTitle
    }
  }, [])

  useEffect(() => {
    if (!validKey) {
      setMessage('Invalid admin access route.')
      setMessageType('error')
      return undefined
    }

    let cancelled = false

    async function checkSession() {
      try {
        const response = await fetch(sessionPath, {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'application/json'
          }
        })

        if (!response.ok || cancelled) return

        const data = await response.json().catch(() => null)

        if (!cancelled && data?.success === true) {
          window.location.replace(panelPath)
        }
      } catch {
        // An unavailable session check does not grant access.
      }
    }

    checkSession()

    return () => {
      cancelled = true
    }
  }, [validKey, sessionPath, panelPath])

  function showMessage(text, type = '') {
    setMessage(text)
    setMessageType(type)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (submitting) return

    const form = event.currentTarget
    const formData = new FormData(form)

    const username = String(formData.get('username') || '').trim()
    const password = String(formData.get('password') || '')

    if (!username || !password) {
      showMessage('Enter your admin username and password.', 'error')
      return
    }

    if (!validKey) {
      showMessage('Invalid admin access route.', 'error')
      return
    }

    setSubmitting(true)
    showMessage('Verifying admin credentials...')

    try {
      const response = await fetch(loginPath, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          username,
          password
        })
      })

      const data = await response.json().catch(() => null)

      if (!response.ok || data?.success !== true) {
        showMessage(
          data?.message || 'Unable to sign in to admin panel.',
          'error'
        )
        return
      }

      showMessage(
        'Access granted. Redirecting to admin panel...',
        'success'
      )

      // The authenticated backend owns the destination.
      // Do not accept unrelated external redirect URLs.
      const destination =
        data.redirectTo === panelPath
          ? data.redirectTo
          : panelPath

      window.location.replace(destination)
    } catch {
      showMessage(
        'Network error while signing in. Please try again.',
        'error'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="admin-auth-shell">
      <section className="admin-auth-card">
        <div className="admin-auth-brand">
          <div className="admin-auth-mark">
            <img
              src="/images/logo.png"
              alt="Young Hustlers Universe logo"
            />
          </div>
          <div>
            <p className="admin-auth-eyebrow">
              Young Hustlers Universe
            </p>
            <h1>Admin Access</h1>
          </div>
        </div>

        <div className="admin-auth-copy">
          <p
            id="admin-auth-route-status"
            className="admin-auth-route-status"
          >
            Secure admin access.
          </p>
          <p className="admin-auth-subtitle">
            Enter your admin credentials to open the control room.
          </p>
        </div>

        <form
          id="admin-login-form"
          className="admin-auth-form"
          method="post"
          autoComplete="on"
          onSubmit={handleSubmit}
        >
          <div className="form-group">
            <label htmlFor="admin-username">Admin Username</label>
            <input
              id="admin-username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="Enter admin username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="admin-password">Admin Password</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter admin password"
              required
            />
          </div>

          <button
            type="submit"
            id="admin-login-submit"
            className="primary-btn"
            disabled={submitting || !validKey}
          >
            {submitting ? 'Verifying...' : 'Enter Admin Panel ➔'}
          </button>
        </form>

        <div
          id="admin-auth-message"
          className={`admin-auth-message ${messageType}`.trim()}
          aria-live="polite"
        >
          {message}
        </div>

        <div className="admin-auth-foot">
          <span>Session duration: 8 hours on this browser</span>
        </div>
      </section>
    </main>
  )
}
