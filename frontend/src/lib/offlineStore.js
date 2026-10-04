// Tiny IndexedDB key-value store for offline chat data
const DB_NAME = 'mattchat-offline-data'
const STORE = 'kv'

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function kvGet(key) {
  const db = await open()
  return new Promise((resolve) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => resolve(null)
  })
}

export async function kvSet(key, value) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

const clean = (v) => JSON.parse(JSON.stringify(v)) // strips functions/blobs so IndexedDB can store it

// ── Messages: last 100 real (non-pending) messages per conversation ──
export const cacheMessages = (cid, msgs) =>
  kvSet(`msgs:${cid}`, clean(msgs.filter((m) => !m._optimistic).slice(-100)))
export const getCachedMessages = (cid) => kvGet(`msgs:${cid}`)

// ── Conversation list ──
export const cacheConversations = (uid, list) => kvSet(`convos:${uid}`, clean(list))
export const getCachedConversations = (uid) => kvGet(`convos:${uid}`)

// ── Outbox: text messages written while offline ──
export async function getOutbox() { return (await kvGet('outbox')) || [] }
export async function addToOutbox(item) { await kvSet('outbox', [...(await getOutbox()), item]) }
async function removeFromOutbox(tempId) {
  await kvSet('outbox', (await getOutbox()).filter((o) => o.tempId !== tempId))
}

let inflight = null
export function flushOutbox(sendFn) {
  if (inflight) return inflight
  if (!navigator.onLine) return Promise.resolve()
  inflight = (async () => {
    try {
      for (const item of await getOutbox()) {
        try {
          await sendFn(item.conversationId, item.senderId, item.content)
          await removeFromOutbox(item.tempId)
        } catch (e) {
          console.error('[outbox] send failed, will retry:', e)
          break // keep the order; try again on the next reconnect
        }
      }
    } finally { inflight = null }
  })()
  return inflight
}
