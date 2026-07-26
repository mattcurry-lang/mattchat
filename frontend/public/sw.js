// public/sw.js
//
// Handles incoming push events and notification interactions. Kept
// deliberately dependency-free (no bundler) since service workers run
// in a separate global scope from the app's React code.

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

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
    icon = '/logo192.png',
    badge = '/logo192.png',
    tag,          // grouping key — e.g. conversation id, so repeated
                   // messages from the same chat replace rather than stack
    data = {},    // { url, type, conversationId, ... } — read on click
    actions = [], // [{ action: 'reply', title: 'Reply' }, ...]
    requireInteraction = false,
  } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body, icon, badge, tag, data, actions, requireInteraction,
      renotify: !!tag,
    })
  )
})

// Handles both a plain notification tap and a quick-action button tap.
// `event.action` is '' for a plain tap, or the action id (e.g. 'reply',
// 'answer', 'decline') when a quick-action button was pressed.
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
