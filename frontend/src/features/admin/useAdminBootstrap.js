import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  getAdminBootstrap,
} from './adminApi'

export function useAdminBootstrap() {
  const [version, setVersion] = useState(0)

  const [result, setResult] = useState({
    status: 'loading',
    state: null,
    user: null,
    error: '',
  })

  const refresh = useCallback(() => {
    setVersion(value => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    let active = true

    async function load() {
      setResult(previous => ({
        ...previous,
        status: 'loading',
        error: '',
      }))

      try {
        const data = await getAdminBootstrap(
          controller.signal
        )

        if (!active) return

        setResult({
          status: 'ready',
          state: data.state,
          user: data.user,
          error: '',
        })
      } catch (error) {
        if (!active || controller.signal.aborted) {
          return
        }

        const unauthorized = error.status === 401

        setResult({
          status: unauthorized
            ? 'unauthorized'
            : 'error',
          state: null,
          user: null,
          error: unauthorized
            ? 'Admin session expired. Please sign in again.'
            : error.message || 'Failed to load live admin data.',
        })
      }
    }

    load()

    return () => {
      active = false
      controller.abort()
    }
  }, [version])

  return {
    ...result,
    refresh,
  }
}
