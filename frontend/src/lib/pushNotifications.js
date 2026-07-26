import { supabase } from './supabase'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function registerServiceWorker() {
  if (!isPushSupported()) return null
  await navigator.serviceWorker.register('/sw.js')
  // .ready resolves only once a service worker is actually active and
  // controlling this scope — register() alone doesn't guarantee that,
  // which is what caused "no active Service Worker" on first attempt.
  return navigator.serviceWorker.ready
}

export async function getNotificationPermissionState() {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export async function subscribeToPush(userId) {
  if (!isPushSupported()) throw new Error('Push notifications are not supported in this browser.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')

  const registration = await registerServiceWorker()
  if (!registration) throw new Error('Service worker registration failed.')

  const existing = await registration.pushManager.getSubscription()
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.REACT_APP_VAPID_PUBLIC_KEY),
  })

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent,
    last_used_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })
  if (error) throw error

  return subscription
}

export async function unsubscribeFromPush(userId) {
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    const endpoint = subscription.endpoint
    await subscription.unsubscribe()
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', userId)
  }
}

// Listens for messages posted from the service worker when a
// notification (or its quick-action button) is clicked, so the app can
// react in-context — e.g. jump straight to a conversation, or answer a
// call — instead of just opening the homepage.
export function listenForNotificationActions(handler) {
  if (!('serviceWorker' in navigator)) return () => {}
  const listener = (event) => {
    if (event.data?.type === 'notification-action') handler(event.data.action, event.data.data)
  }
  navigator.serviceWorker.addEventListener('message', listener)
  return () => navigator.serviceWorker.removeEventListener('message', listener)
}
