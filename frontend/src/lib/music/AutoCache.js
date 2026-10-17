import { OfflineCache, AUTO_LIMIT } from './OfflineCache'
import { getDownloadUrl } from './getDownloadUrl'

const PREF_KEY = 'mattchat:music:autoCache'
const inflight = new Set()

async function hasRoom() {
  try {
    const e = await navigator.storage?.estimate?.()
    if (e?.quota && e.usage / e.quota > 0.85) return false
  } catch { /* unknown -> allow */ }
  return true
}

export const AutoCache = {
  limit: AUTO_LIMIT,

  isEnabled() {
    try { return localStorage.getItem(PREF_KEY) !== '0' } catch { return true }
  },
  setEnabled(on) {
    try { localStorage.setItem(PREF_KEY, on ? '1' : '0') } catch { /* ignore */ }
  },

  async noteHeard(track, origin = 'auto') {
    if (!track?.id || !track.isDownloadable) return 'skipped'
    const src = origin === 'chat' ? 'chat' : 'auto'

    const alreadyCached = await OfflineCache.isDownloaded(track.id).catch(() => false)
    if (alreadyCached) {
      if (OfflineCache.isHeardEntry(track.id)) OfflineCache.markHeard(track.id, src)
      return 'cached'
    }

    if (!this.isEnabled()) return 'disabled'
    if (navigator.connection?.saveData) return 'data-saver'
    if (!(await hasRoom())) return 'no-space'
    if (inflight.has(track.id)) return 'busy'

    inflight.add(track.id)
    try {
      const url = await getDownloadUrl(track)
      if (!url) return 'no-url'
      await OfflineCache.downloadTrack(track, url, undefined, src)
      OfflineCache.markHeard(track.id, src)
      await OfflineCache.evictAuto(AUTO_LIMIT)
      return 'saved'
    } catch {
      return 'failed'
    } finally {
      inflight.delete(track.id)
    }
  },
}
