import React, { useEffect, useRef, useState } from 'react'
import { OfflineCache } from '../../../lib/music/OfflineCache'
import { getDownloadUrl } from '../../../lib/music/getDownloadUrl'
import { getArtistTracks } from '../../../lib/music/getArtistTracks'
import { useOnlineStatus } from '../../../hooks/useOnlineStatus'
import { useMusicColors } from '../../../hooks/useMusicColors'
import { IconDownload, IconLoader2 } from '../../Icons'

const ALLOWED = ['mattchat', 'audius', 'jamendo']
const MAX_PER_RUN = 25 // keeps one tap from filling someone's storage
const eligible = (t) => t?.isDownloadable && ALLOWED.includes(t.provider)

/**
 * Pass `tracks` to download a list (e.g. the Free to download shelf),
 * or `artistOf={track}` to download more by that track's artist.
 */
export default function DownloadAllButton({ tracks = null, artistOf = null, label = 'Download all' }) {
  const colors = useMusicColors()
  const online = useOnlineStatus()
  const [working, setWorking] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [message, setMessage] = useState(null)
  const cancelRef = useRef(false)
  const aliveRef = useRef(true)

  useEffect(() => () => { aliveRef.current = false; cancelRef.current = true }, [])

  if (artistOf && !(ALLOWED.includes(artistOf.provider) && artistOf.artistId)) return null
  if (tracks && !tracks.some(eligible)) return null
  if (!tracks && !artistOf) return null

  const flash = (text) => {
    if (!aliveRef.current) return
    setMessage(text)
    setTimeout(() => aliveRef.current && setMessage(null), 5000)
  }

  const run = async () => {
    if (working) return
    setMessage(null)
    setWorking(true)
    cancelRef.current = false
    try {
      const list = tracks || (await getArtistTracks(artistOf))
      const downloadable = (list || []).filter(eligible)
      const have = new Set((await OfflineCache.listDownloads()).map((d) => d.id))
      const todo = downloadable.filter((t) => !have.has(t.id)).slice(0, MAX_PER_RUN)

      if (!todo.length) {
        flash(downloadable.length ? 'Everything here is already downloaded' : 'No downloadable songs found')
        return
      }

      // ask the browser not to evict our offline songs when storage runs low
      navigator.storage?.persist?.().catch(() => {})
      if (navigator.storage?.estimate) {
        const { usage, quota } = await navigator.storage.estimate()
        if (quota && usage / quota > 0.9) { flash('Device storage is almost full'); return }
      }

      let ok = 0
      let failed = 0
      setProgress({ done: 0, total: todo.length })
      for (let i = 0; i < todo.length; i++) {
        if (cancelRef.current) break
        try {
          const url = await getDownloadUrl(todo[i])
          if (!url) throw new Error('No download link')
          await OfflineCache.downloadTrack(todo[i], url)
          ok++
        } catch (e) {
          failed++
          console.error('[download all] failed:', todo[i].title, e)
        }
        if (aliveRef.current) setProgress({ done: i + 1, total: todo.length })
      }
      flash(`Saved ${ok} song${ok === 1 ? '' : 's'} offline${failed ? ` · ${failed} failed` : ''}${cancelRef.current ? ' · stopped' : ''}`)
    } catch (e) {
      console.error('[download all] failed:', e)
      flash('Could not download right now')
    } finally {
      if (aliveRef.current) setWorking(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button
        onClick={run}
        disabled={working || !online}
        title={online ? '' : 'Needs an internet connection'}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700,
          padding: '7px 12px', borderRadius: 999, border: `1px solid ${colors.border}`,
          cursor: working || !online ? 'default' : 'pointer', fontFamily: 'inherit',
          background: colors.surface2, color: colors.textPrimary, opacity: online ? 1 : 0.5,
        }}
      >
        {working
          ? <IconLoader2 size={13} style={{ animation: 'mattchatDlAllSpin 1s linear infinite' }} />
          : <IconDownload size={13} />}
        {working ? `Downloading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : label}
        <style>{`@keyframes mattchatDlAllSpin { to { transform: rotate(360deg); } }`}</style>
      </button>
      {working && (
        <button
          onClick={() => { cancelRef.current = true }}
          style={{ fontSize: 11.5, fontWeight: 700, color: colors.textMuted, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Cancel
        </button>
      )}
      {message && <span style={{ fontSize: 11.5, color: colors.textMuted }}>{message}</span>}
    </div>
  )
}
