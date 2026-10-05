import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { OfflineCache } from '../../../lib/music/OfflineCache'
import { getDownloadUrl } from '../../../lib/music/getDownloadUrl'
import { saveBlobToDevice } from './DownloadButton'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { useOnlineStatus } from '../../../hooks/useOnlineStatus'
import { IconDownload, IconCheck, IconLoader2, IconHeart, IconMusic } from '../../Icons'

const DOWNLOADABLE_PROVIDERS = ['mattchat', 'audius', 'jamendo']
const MENU_W = 260

function Item({ icon, label, sub, onClick, disabled, accent }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px',
        background: 'none', border: 'none', textAlign: 'left', fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        color: accent ? '#4ade80' : '#f2f0f8',
      }}
    >
      <span style={{ width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{sub}</span>}
      </span>
    </button>
  )
}

export default function TrackDownloadMenu({ track, size = 16 }) {
  const { isLiked, toggleLike } = useMusicPlayer()
  const online = useOnlineStatus()
  const btnRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const [status, setStatus] = useState('none') // none | downloading | done
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  const isYouTube = track.provider === 'youtube'
  const knownSource = DOWNLOADABLE_PROVIDERS.includes(track.provider)
  const canDownload = knownSource && Boolean(track.isDownloadable)
  const saved = isLiked(track.id)

  useEffect(() => {
    if (!canDownload) return
    let cancelled = false
    const check = () => OfflineCache.isDownloaded(track.id)
      .then((yes) => { if (!cancelled) setStatus((s) => (s === 'downloading' ? s : yes ? 'done' : 'none')) })
      .catch(() => {})
    check()
    window.addEventListener('mattchat-downloads-changed', check)
    return () => { cancelled = true; window.removeEventListener('mattchat-downloads-changed', check) }
  }, [track.id, canDownload])

  const toggleMenu = (e) => {
    e.stopPropagation()
    if (open) { setOpen(false); return }
    const r = btnRef.current.getBoundingClientRect()
    const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8))
    const openUp = r.bottom + 240 > window.innerHeight
    setPos(openUp ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: r.bottom + 6 })
    setError(null)
    setOpen(true)
  }

  const saveOffline = useCallback(async () => {
    if (status === 'downloading') return
    setError(null)
    if (status === 'done') {
      await OfflineCache.deleteDownload(track.id).catch(() => {})
      setStatus('none')
      return
    }
    setStatus('downloading'); setProgress(0)
    try {
      const url = await getDownloadUrl(track)
      if (!url) throw new Error('No download link for this song')
      await OfflineCache.downloadTrack(track, url, setProgress)
      setStatus('done')
    } catch (err) {
      console.error('[download] failed:', err)
      setError(err.message || 'Download failed')
      setStatus('none')
    }
  }, [status, track])

  const saveToDevice = useCallback(async () => {
    setError(null)
    try {
      let blob = await OfflineCache.getBlob(track.id)
      if (!blob) {
        const url = await getDownloadUrl(track)
        if (!url) throw new Error('No download link for this song')
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Download failed (${res.status})`)
        blob = await res.blob()
      }
      saveBlobToDevice(track, blob)
      setOpen(false)
    } catch (err) {
      console.error('[save to device] failed:', err)
      setError(err.message || 'Could not save file')
    }
  }, [track])

  const triggerIcon =
    status === 'downloading' ? <IconLoader2 size={size} style={{ animation: 'mattchatMenuSpin 1s linear infinite' }} />
    : status === 'done' ? <IconCheck size={size} />
    : <IconDownload size={size} />

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggleMenu}
        title="Download & save options"
        aria-label="Download and save options"
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 6,
          display: 'flex', alignItems: 'center', position: 'relative',
          color: status === 'done' ? '#4ade80' : 'var(--text-muted)',
        }}
      >
        {triggerIcon}
        <style>{`@keyframes mattchatMenuSpin { to { transform: rotate(360deg); } }`}</style>
      </button>

      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1999 }} />
          <div
            style={{
              position: 'fixed', zIndex: 2000, width: MENU_W, ...pos,
              background: 'rgba(24,22,34,0.98)', border: '1px solid rgba(167,139,250,0.22)',
              borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,0.45)', overflow: 'hidden', padding: '6px 0',
            }}
          >
            {canDownload && (
              <>
                <Item
                  icon={status === 'downloading' ? <IconLoader2 size={16} style={{ animation: 'mattchatMenuSpin 1s linear infinite' }} /> : status === 'done' ? <IconCheck size={16} /> : <IconDownload size={16} />}
                  label={status === 'downloading' ? `Saving… ${progress}%` : status === 'done' ? 'Saved offline in Mattchat' : 'Save offline in Mattchat'}
                  sub={status === 'done' ? 'Tap to remove' : 'Plays without internet, stays inside the app'}
                  accent={status === 'done'}
                  disabled={status !== 'done' && !online}
                  onClick={saveOffline}
                />
                <Item
                  icon={<IconDownload size={16} />}
                  label="Save file to this device"
                  sub="Goes to your Downloads folder"
                  disabled={!online && status !== 'done'}
                  onClick={saveToDevice}
                />
              </>
            )}

            {!canDownload && knownSource && (
              <Item icon={<IconDownload size={16} />} label="Downloads not available" sub="The artist hasn't allowed downloads for this song" disabled />
            )}

            {isYouTube && (
              <Item
                icon={<IconMusic size={16} />}
                label="Open in YouTube Music"
                sub="Premium members can download it there"
                disabled={!online}
                onClick={() => {
                  window.open(`https://music.youtube.com/watch?v=${track.providerTrackId}`, '_blank', 'noopener,noreferrer')
                  setOpen(false)
                }}
              />
            )}

            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
            <Item
              icon={<IconHeart size={16} filled={saved} />}
              label={saved ? 'Remove from Saved songs' : 'Add to Saved songs'}
              sub={isYouTube ? 'Keeps a shortcut. Playing it needs internet.' : undefined}
              accent={saved}
              onClick={() => toggleLike(track)}
            />

            {error && <div style={{ padding: '6px 14px 8px', fontSize: 11, color: '#f87171' }}>{error}</div>}
          </div>
        </>,
        document.body
      )}
    </>
  )
}
