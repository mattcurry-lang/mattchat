import { OfflineCache } from '../../../lib/music/OfflineCache'
import { getDownloadUrl } from '../../../lib/music/getDownloadUrl'
import { IconDownload, IconCheck, IconLoader2 } from '../../Icons'

// Triggers the browser/phone's normal "save file" flow (lands in Downloads)
export function saveBlobToDevice(track, blob) {
  const ext = (blob.type.split('/')[1] || 'mp3').replace('mpeg', 'mp3')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${track.artist} - ${track.title}.${ext}`.replace(/[\\/:*?"<>|]/g, '')
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}

export default function DownloadButton({ track, size = 17 }) {
  const [status, setStatus] = useState('checking') // checking | none | downloading | done
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    OfflineCache.isDownloaded(track.id)
      .then((yes) => { if (!cancelled) setStatus(yes ? 'done' : 'none') })
      .catch(() => { if (!cancelled) setStatus('none') })   // don't hide the button if the cache check fails
    return () => { cancelled = true }
  }, [track.id])

  const handleOffline = useCallback(async (e) => {
    e.stopPropagation()
    if (status === 'downloading') return
    if (status === 'done') { await OfflineCache.deleteDownload(track.id); setStatus('none'); return }
    setStatus('downloading'); setProgress(0); setError(null)
    try {
    const url = await getDownloadUrl(track)
      if (!url) throw new Error('No download link for this track')
      await OfflineCache.downloadTrack(track, url, setProgress)
      setStatus('done')
    } catch (err) {
      console.error('[download] failed:', err)
      setError(err.message || 'Download failed')
      setStatus('none')
    }
  }, [status, track])

 const handleDevice = useCallback(async (e) => {
  e.stopPropagation()
  setError(null)
  try {
    let blob = await OfflineCache.getBlob(track.id)        // reuse the offline copy if we have it
    if (!blob) {
   const url = await getDownloadUrl(track)
      if (!url) throw new Error('No download link for this track')
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Download failed (${res.status})`)
      blob = await res.blob()
    }
    saveBlobToDevice(track, blob)
  } catch (err) {
    console.error('[save to device] failed:', err)
    setError(err.message || 'Could not save file')
  }
}, [track])

  if (status === 'checking') return null
  const btn = { background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', position: 'relative' }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
      <button onClick={handleOffline} title={status === 'done' ? 'Remove offline copy' : 'Save for offline in Mattchat'}
        style={{ ...btn, color: status === 'done' ? '#a78bfa' : 'var(--text-muted)' }}>
        {status === 'downloading' && (<>
          <IconLoader2 size={size} style={{ animation: 'mattchatDownloadSpin 1s linear infinite' }} />
          <span style={{ position: 'absolute', bottom: -14, fontSize: 9, fontWeight: 700 }}>{progress}%</span>
          <style>{`@keyframes mattchatDownloadSpin { to { transform: rotate(360deg); } }`}</style>
        </>)}
        {status === 'done' && <IconCheck size={size} />}
        {status === 'none' && <IconDownload size={size} />}
      </button>
      <button onClick={handleDevice} title="Save to this device" style={{ ...btn, color: 'var(--text-muted)', fontSize: 10, fontWeight: 800 }}>
        <IconDownload size={size - 3} /><span style={{ marginLeft: 2 }}>↓</span>
      </button>
      {error && <span style={{ position: 'absolute', top: '100%', right: 0, fontSize: 10, color: '#f87171', whiteSpace: 'nowrap' }}>{error}</span>}
    </span>
  )
}
