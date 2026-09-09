const DB_NAME = 'mattchat-music-offline'
const STORE = 'tracks'
const DB_VERSION = 1

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore(mode, fn) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    const result = fn(store)
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
  })
}

export const OfflineCache = {
  async isDownloaded(trackId) {
    const record = await withStore('readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.get(trackId)
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => resolve(null)
      })
    })
    return Boolean(record)
  },

  async listDownloads() {
    return withStore('readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.getAll()
        req.onsuccess = () => resolve((req.result || []).map(({ blob, ...meta }) => meta))
        req.onerror = () => resolve([])
      })
    })
  },

  // Returns a usable <audio> src, or null if not cached — safe to call speculatively.
  async getBlobUrl(trackId) {
    const record = await withStore('readonly', (store) => {
      return new Promise((resolve) => {
        const req = store.get(trackId)
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => resolve(null)
      })
    })
    if (!record) return null
    return URL.createObjectURL(record.blob)
  },

  async downloadTrack(track, signedUrl, onProgress) {
    const res = await fetch(signedUrl)
    if (!res.ok || !res.body) throw new Error('Download failed')

    const total = Number(res.headers.get('content-length')) || track.duration ? 0 : 0
    const contentLength = Number(res.headers.get('content-length')) || 0
    const reader = res.body.getReader()
    const chunks = []
    let received = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      if (onProgress && contentLength) onProgress(Math.min(100, Math.round((received / contentLength) * 100)))
    }

    const blob = new Blob(chunks)
    await withStore('readwrite', (store) => {
      store.put({
        id: track.id,
        title: track.title,
        artist: track.artist,
        artwork: track.artwork,
        duration: track.duration,
        blob,
        downloadedAt: Date.now(),
      })
    })
    return true
  },

  async deleteDownload(trackId) {
    await withStore('readwrite', (store) => store.delete(trackId))
  },
}
