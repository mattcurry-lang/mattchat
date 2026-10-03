const DB_NAME = 'mattchat-music-offline'
const STORE = 'tracks'
const DB_VERSION = 1

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
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
    tx.onabort = () => reject(tx.error || new Error('Storage full or blocked'))
  })
}

const getRecord = (trackId) =>
  withStore('readonly', (store) => new Promise((resolve) => {
    const req = store.get(trackId)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => resolve(null)
  }))

const notify = () => window.dispatchEvent(new CustomEvent('mattchat-downloads-changed'))

export const OfflineCache = {
  async isDownloaded(trackId) {
    return Boolean(await getRecord(trackId))
  },

  async listDownloads() {
    const all = await withStore('readonly', (store) => new Promise((resolve) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => resolve([])
    }))
    return all.map(({ blob, ...meta }) => meta).sort((a, b) => b.downloadedAt - a.downloadedAt)
  },

  async getBlob(trackId) {
    const record = await getRecord(trackId)
    return record ? record.blob : null
  },

  // Safe to call speculatively: returns null if the track isn't cached
  async getBlobUrl(trackId) {
    const blob = await this.getBlob(trackId)
    return blob ? URL.createObjectURL(blob) : null
  },

  async downloadTrack(track, signedUrl, onProgress) {
    const res = await fetch(signedUrl)
    if (!res.ok) throw new Error(`Download failed (${res.status})`)

    const contentType = res.headers.get('content-type') || 'audio/mpeg'
    const contentLength = Number(res.headers.get('content-length')) || 0
    let blob

    if (res.body && contentLength) {
      const reader = res.body.getReader()
      const chunks = []
      let received = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        onProgress?.(Math.min(100, Math.round((received / contentLength) * 100)))
      }
      blob = new Blob(chunks, { type: contentType })
    } else {
      blob = new Blob([await res.arrayBuffer()], { type: contentType }) // no length header: no % progress
    }

    const { streamUrl, ...trackMeta } = track
    await withStore('readwrite', (store) => {
      store.put({
        id: track.id,
        title: track.title,
        artist: track.artist,
        artwork: track.artwork,
        duration: track.duration,
        track: trackMeta,            // full track object so it can be played from the Downloads list
        blob,
        downloadedAt: Date.now(),
      })
    })
    onProgress?.(100)
    notify()
    return true
  },

  async deleteDownload(trackId) {
    await withStore('readwrite', (store) => store.delete(trackId))
    notify()
  },
}
