/* eslint-disable no-restricted-globals */
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate, CacheFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

clientsClaim()
precacheAndRoute(self.__WB_MANIFEST) // every JS/CSS/HTML file from the build

// Single-page app: any page navigation gets index.html, so the app opens offline
const fileExt = /\/[^/?]+\.[^/]+$/
registerRoute(
  ({ request, url }) => request.mode === 'navigate' && !url.pathname.startsWith('/_') && !fileExt.test(url.pathname),
  createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html')
)

// Never cache backend calls, auth or live data
registerRoute(({ url }) => url.hostname.endsWith('supabase.co'), new NetworkOnly())

// Images (avatars, album art, stickers), including cross-origin ones
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'mattchat-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
)

// Fonts
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'mattchat-fonts',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 30 })],
  })
)

// Lets the page tell a waiting update to take over
self.addEventListener('message', (e) => { if (e.data?.type === 'SKIP_WAITING') self.skipWaiting() })

// ── Push notifications (moved here from public/sw.js) ──
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch (e) {
    payload = { title: 'Mattchat', body: event.data.text() }
  }

  const {
    title = 'Mattchat',
    body = '',
    icon = '/android-chrome-192x192.png',
    badge = '/android-chrome-192x192.png',
    tag,
    data = {},
    actions = [],
    requireInteraction = false,
  } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body, icon, badge, tag, data, actions, requireInteraction,
      renotify: !!tag,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const targetUrl = data.url || '/'

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = allClients.find((c) => c.url.includes(self.location.origin))

      if (existing) {
        existing.focus()
        existing.postMessage({ type: 'notification-action', action: event.action, data })
      } else {
        await self.clients.openWindow(targetUrl)
      }
    })()
  )
})
