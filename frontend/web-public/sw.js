const CACHE = 'yhu-static-v1'

const PRECACHE = [
  '/manifest.webmanifest',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('yhu-static-') && key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) return

  if (
    request.mode === 'navigate' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/socket.io/') ||
    url.pathname.startsWith('/uploads/') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/internal/') ||
    url.pathname.startsWith('/collections')
  ) {
    return
  }

  if (
    !url.pathname.startsWith('/assets/') &&
    !url.pathname.startsWith('/images/') &&
    !url.pathname.startsWith('/pwa/') &&
    !url.pathname.startsWith('/sounds/') &&
    url.pathname !== '/manifest.webmanifest'
  ) {
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()

          caches.open(CACHE).then((cache) => {
            cache.put(request, copy)
          })
        }

        return response
      })
    })
  )
})
